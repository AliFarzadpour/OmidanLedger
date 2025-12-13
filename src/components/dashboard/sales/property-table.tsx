'use client';

import { Property } from './property-form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface PropertyTableProps {
  properties: Property[];
  onEdit: (property: Property) => void;
}

export function PropertyTable({ properties, onEdit }: PropertyTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Property Name</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Target Rent</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {properties.map((property) => (
          <TableRow key={property.id}>
            <TableCell className="font-medium">{property.name}</TableCell>
            <TableCell>{`${property.address.street}, ${property.address.city}, ${property.address.state}`}</TableCell>
            <TableCell>
              <Badge variant="outline">{property.specs?.type}</Badge>
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(property.financials?.targetRent || 0)}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => onEdit(property)}>
                <Edit className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
