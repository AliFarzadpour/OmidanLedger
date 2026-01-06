
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'; 
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Trash2, Phone, Mail, Loader2, Edit2, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// --- EXPANDED MULTI-SECTOR TRADES LIST ---
const VENDOR_ROLES = [
  // Real Estate / Trade
  "Appliance Repair", "Architect", "Carpenter", "Carpet/Flooring", 
  "Cleaning/Janitorial", "Concrete/Paving", "Electrician", "Exterminator/Pest", 
  "General Contractor", "Handyman", "HVAC", "Inspector", "Landscaper", 
  "Locksmith", "Painter", "Plumber", "Property Manager", "Roofer", 
  "Security Services", "Surveyor", "Trash/Waste", "Water/Sewer", "Window/Door",
  
  // Professional Services
  "Accountant/CPA", "Attorney/Legal", "Consultant", "Designer", 
  "Engineer", "HR/Staffing Agency", "Insurance Agent", "Marketing/Advertising", 
  "Notary", "Real Estate Agent", "Translator",
  
  // Business Ops & Tech
  "Bank/Lender", "Courier/Delivery", "Event Services", "IT/Tech Support", 
  "Internet/Telecom", "Office Supplies", "Printing/Signage", "Software/SaaS", 
  "Travel Agency", "Utility Provider",
  
  // Retail / Supply Chain
  "Distributor", "Logistics/Freight", "Manufacturer", "Supplier/Wholesaler", 
  "Vendor/Merchandiser",
  
  // General
  "Government Entity", "Other"
].sort();

// STANDARD ACCOUNTING CATEGORIES
const EXPENSE_CATEGORIES = [
  "Advertising & Marketing", "Capital Expenses (CapEx)", "Cost of Goods Sold (COGS)", 
  "Dues & Subscriptions", "Equipment Lease", "Insurance", "Legal & Professional", 
  "Licenses & Fees", "Maintenance & Repairs", "Management Fees", "Meals & Entertainment", 
  "Office Expenses", "Payroll/Labor", "Rent/Lease", "Software & Tech", 
  "Supplies", "Taxes", "Travel", "Utilities"
].sort();

export default function VendorManager() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({ name: '', role: '', phone: '', email: '', company: '', defaultCategory: '' });

  const fetchVendors = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      const q = query(collection(firestore, 'vendors'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendors(data);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchVendors(); }, [user, firestore]);

  const handleSave = async () => {
    if (!user || !firestore || !formData.name || !formData.role) return;
    setIsSaving(true);
    try {
      if (editingVendor) {
        const ref = doc(firestore, 'vendors', editingVendor.id);
        await updateDoc(ref, { ...formData });
        toast({ title: "Updated", description: "Vendor details saved." });
      } else {
        await addDoc(collection(firestore, 'vendors'), {
          userId: user.uid,
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast({ title: "Created", description: "New vendor added to Rolodex." });
      }
      setIsAddOpen(false);
      setEditingVendor(null);
      setFormData({ name: '', role: '', phone: '', email: '', company: '', defaultCategory: '' });
      fetchVendors();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      const docRef = doc(firestore, 'vendors', id);
      await deleteDoc(docRef);
      toast({ title: "Deleted", description: "Vendor removed." });
      fetchVendors();
    } catch (error: any) {
        console.error("Error deleting vendor: ", error);
        toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
    } finally {
        setDeletingId(null);
    }
  };

  const openEdit = (vendor: any) => {
    setEditingVendor(vendor);
    setFormData({
       name: vendor.name || '',
       role: vendor.role || '',
       phone: vendor.phone || '',
       email: vendor.email || '',
       company: vendor.company || '',
       defaultCategory: vendor.defaultCategory || ''
    });
    setIsAddOpen(true);
  };

  const filteredVendors = vendors.filter(v => 
    v.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8">
      
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Database</h1>
          <p className="text-muted-foreground">Manage contractors and assign accounting rules.</p>
        </div>
        <Button onClick={() => { setEditingVendor(null); setFormData({name:'', role:'', phone:'', email:'', company:'', defaultCategory:''}); setIsAddOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Add Vendor
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search vendors..." 
          className="pl-10 max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Default Category</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
              ) : filteredVendors.length === 0 ? (
                 <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No vendors found.</TableCell></TableRow>
              ) : (
                 filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                       <Badge variant="outline" className="font-normal">{vendor.role}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                       <div>{vendor.name}</div>
                       {vendor.company && <div className="text-xs text-muted-foreground">{vendor.company}</div>}
                    </TableCell>
                    <TableCell>
                       {vendor.defaultCategory ? (
                          <div className="flex items-center gap-1 text-xs bg-slate-100 w-fit px-2 py-1 rounded text-slate-700">
                             <Tag className="h-3 w-3" /> {vendor.defaultCategory}
                          </div>
                       ) : <span className="text-xs text-muted-foreground italic">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                       <div className="space-y-1 text-sm">
                          {vendor.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-slate-400"/> {vendor.phone}</div>}
                          {vendor.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-slate-400"/> {vendor.email}</div>}
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => openEdit(vendor)}><Edit2 className="h-4 w-4 text-slate-500 hover:text-blue-600"/></Button>
                       {deletingId === vendor.id ? (
                         <Button variant="destructive" size="sm" onClick={() => handleDelete(vendor.id)}>Confirm</Button>
                       ) : (
                         <Button variant="ghost" size="icon" onClick={() => setDeletingId(vendor.id)}><Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600"/></Button>
                       )}
                    </TableCell>
                  </TableRow>
                 ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                   <Label>Name *</Label>
                   <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="John Doe" />
                </div>
                <div className="grid gap-2">
                   <Label>Role *</Label>
                   <Select onValueChange={(v) => setFormData({...formData, role: v})} value={formData.role}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                         {VENDOR_ROLES.map(role => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>
             </div>
             
             {/* THE ACCOUNTING LINK */}
             <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <Label className="mb-2 block text-xs font-semibold text-slate-600">Accounting Automation</Label>
                <div className="grid gap-2">
                   <Label className="text-xs font-normal text-muted-foreground">When I pay this vendor, automatically categorize as:</Label>
                   <Select onValueChange={(v) => setFormData({...formData, defaultCategory: v})} value={formData.defaultCategory}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select Default Expense Category..." /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                         {EXPENSE_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>
             </div>

             <div className="grid gap-2">
                <Label>Company</Label>
                <Input value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} placeholder="Company Name LLC" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Email</Label><Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
             </div>
          </div>
          <DialogFooter>
             <Button onClick={handleSave} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Vendor"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

    