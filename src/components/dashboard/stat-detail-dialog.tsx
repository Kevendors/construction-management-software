"use client";

import { Dialog } from "@/components/ui/dialog";

interface StatDetailDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function StatDetailDialog({ open, onClose, title, description, children }: StatDetailDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} className="max-w-2xl">
      {children}
    </Dialog>
  );
}
