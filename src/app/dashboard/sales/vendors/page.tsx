'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Trash2, Phone, Mail, User, Briefcase, Loader2, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function VendorManager() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({ name: '', role: '', phone: '', email: '', company: '' });

  // 1. FETCH VENDORS
  const fetchVendors = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      const q = query(collection(firestore, 'vendors'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendors(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, [user, firestore]);

  // 2. SAVE VENDOR (Create or Update)
  const handleSave = async () => {
    if (!user || !firestore || !formData.name || !formData.role) return;
    setIsSaving(true);
    try {
      if (editingVendor) {
        // UPDATE
        const ref = doc(firestore, 'vendors', editingVendor.id);
        await updateDoc(ref, { ...formData });
        toast({ title: "Vendor Updated", description: `${formData.name} saved.` });
      } else {
        // CREATE
        await addDoc(collection(firestore, 'vendors'), {
          userId: user.uid,
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast({ title: "Vendor Created", description: `${formData.name} added to database.` });
      }
      setIsAddOpen(false);
      setEditingVendor(null);
      setFormData({ name: '', role: '', phone: '', email: '', company: '' });
      fetchVendors();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // 3. DELETE VENDOR
  const handleDelete = async (id: string) => {
    if (!user || !firestore) return;
    if (!confirm("Are you sure? This will remove them from the list, but not from historical transactions.")) return;
    try {
      await deleteDoc(doc(firestore, 'vendors', id));
      toast({ title: "Vendor Deleted", description: "Contact removed." });
      fetchVendors();
    } catch (error) {
      console.error(error);
    }
  };

  // 4. OPEN EDIT MODAL
  const openEdit = (vendor: any) => {
    setEditingVendor(vendor);
    setFormData({
       name: vendor.name || '',
       role: vendor.role || '',
       phone: vendor.phone || '',
       email: vendor.email || '',
       company: vendor.company || ''
    });
    setIsAddOpen(true);
  };

  // Filter Logic
  const filteredVendors = vendors.filter(v => 
    v.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Database</h1>
          <p className="text-muted-foreground">Central list of contractors and professionals.</p>
        </div>
        <Button onClick={() => { setEditingVendor(null); setFormData({name:'', role:'', phone:'', email:'', company:''}); setIsAddOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Add Vendor
        </Button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search by name or role (e.g. Plumber)..." 
          className="pl-10 max-w-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* VENDOR TABLE */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Role</TableHead>
                <TableHead>Contact Name</TableHead>
                <TableHead>Phone / Email</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
              ) : filteredVendors.length === 0 ? (
                 <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No vendors found.</TableCell></TableRow>
              ) : (
                 filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                       <Badge variant="secondary" className="flex w-fit items-center gap-1">
                          <Briefcase className="h-3 w-3" /> {vendor.role}
                       </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                       <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                             {vendor.name.charAt(0)}
                          </div>
                          <div>
                             <div>{vendor.name}</div>
                             {vendor.company && <div className="text-xs text-muted-foreground">{vendor.company}</div>}
                          </div>
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="space-y-1 text-sm">
                          {vendor.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-slate-400"/> {vendor.phone}</div>}
                          {vendor.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-slate-400"/> {vendor.email}</div>}
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => openEdit(vendor)}><Edit2 className="h-4 w-4 text-slate-500 hover:text-blue-600"/></Button>
                       <Button variant="ghost" size="icon" onClick={() => handleDelete(vendor.id)}><Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600"/></Button>
                    </TableCell>
                  </TableRow>
                 ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ADD/EDIT DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                   <Label>Name *</Label>
                   <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" />
                </div>
                <div className="grid gap-2">
                   <Label>Role *</Label>
                   <Select onValueChange={(v) => setFormData({...formData, role: v})} value={formData.role}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="Plumber">Plumber</SelectItem>
                         <SelectItem value="Electrician">Electrician</SelectItem>
                         <SelectItem value="Handyman">Handyman</SelectItem>
                         <SelectItem value="HVAC">HVAC</SelectItem>
                         <SelectItem value="Landscaper">Landscaper</SelectItem>
                         <SelectItem value="Cleaner">Cleaner</SelectItem>
                         <SelectItem value="Lawyer">Lawyer</SelectItem>
                         <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>
             <div className="grid gap-2">
                <Label>Company (Optional)</Label>
                <Input value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} placeholder="e.g. Joe's Repairs LLC" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                   <Label>Phone</Label>
                   <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(555) 000-0000" />
                </div>
                <div className="grid gap-2">
                   <Label>Email</Label>
                   <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="joe@email.com" />
                </div>
             </div>
          </div>
          <DialogFooter>
             <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingVendor ? "Save Changes" : "Create Vendor")}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
