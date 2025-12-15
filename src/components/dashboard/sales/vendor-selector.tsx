'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface Vendor {
    id: string;
    name: string;
    [key: string]: any;
}

interface VendorSelectorProps {
    onSelect: (vendor: Vendor | null) => void;
    initialVendorId?: string;
}

export function VendorSelector({ onSelect, initialVendorId }: VendorSelectorProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedValue, setSelectedValue] = useState(initialVendorId || '');

    useEffect(() => {
        const fetchVendors = async () => {
            if (!user || !firestore) return;
            setLoading(true);
            try {
                const q = query(collection(firestore, 'vendors'), where('userId', '==', user.uid));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Vendor[];
                setVendors(data);
            } catch (error) {
                console.error("Error fetching vendors:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchVendors();
    }, [user, firestore]);

    const handleSelectChange = (vendorId: string) => {
        setSelectedValue(vendorId);
        const selected = vendors.find(v => v.id === vendorId) || null;
        onSelect(selected);
    };
    
    if (loading) {
        return <Skeleton className="h-10 w-full" />;
    }

    return (
        <Select onValueChange={handleSelectChange} value={selectedValue}>
            <SelectTrigger>
                <SelectValue placeholder="Select a vendor..." />
            </SelectTrigger>
            <SelectContent>
                {vendors.map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
