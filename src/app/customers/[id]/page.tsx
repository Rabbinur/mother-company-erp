import React from "react";
import { CompleteCustomerProfile } from "@/components/customers/CompleteCustomerProfile";

export const metadata = {
  title: "Customer Profile | Mother Company ERP",
  description: "Unified customer details, isolated dealership accounts, order and payment history",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <CompleteCustomerProfile customerId={id} />
    </div>
  );
}
