'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UpcomingStockForm } from '@/components/admin/upcoming-stock-form';

export default function CMSUpcomingStockCreatePage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    router.push('/cms/upcoming-stocks');
  };

  return (
    <UpcomingStockForm
      mode="create"
      isOpen={isOpen}
      onCloseAction={handleClose}
      onSuccessAction={() => router.push('/cms/upcoming-stocks')}
      useCmsEndpoint
    />
  );
}
