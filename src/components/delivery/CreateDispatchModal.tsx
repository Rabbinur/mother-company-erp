"use client";

import React, { useState, useEffect } from "react";
import { X, Truck, Check, AlertCircle } from "lucide-react";

interface CreateDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (dispatch: any) => void;
}

export function CreateDispatchModal({ isOpen, onClose, onSuccess }: CreateDispatchModalProps) {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [deliverymen, setDeliverymen] = useState<any[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<any[]>([]);

  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDeliveryman, setSelectedDeliveryman] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch initial options
    Promise.all([
      fetch("/api/v1/delivery/vehicles").then((r) => r.json()),
      fetch("/api/v1/delivery/deliverymen").then((r) => r.json()),
      fetch("/api/v1/sales/orders?status=CONFIRMED&limit=50").then((r) => r.json()),
    ]).then(([vehData, dmanData, ordData]) => {
      if (vehData?.data) setVehicles(vehData.data);
      if (dmanData?.data) setDeliverymen(dmanData.data);
      if (ordData?.data?.orders) {
        setConfirmedOrders(ordData.data.orders);
        if (ordData.data.orders.length > 0) {
          const wId = ordData.data.orders[0].warehouseId?._id || ordData.data.orders[0].warehouseId;
          setSelectedWarehouse(String(wId));
        }
      }
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) {
      setError("Please select an origin warehouse");
      return;
    }
    if (selectedOrderIds.length === 0) {
      setError("Please select at least one confirmed order");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/delivery/dispatches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: selectedWarehouse,
          vehicleId: selectedVehicle || undefined,
          deliverymanId: selectedDeliveryman || undefined,
          orderIds: selectedOrderIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create dispatch");

      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Create Dispatch Trip</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 text-xs text-red-600 bg-red-500/10 border border-red-200 rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Vehicle
              </label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full text-xs rounded-md border border-input bg-background p-2 text-foreground"
              >
                <option value="">Select vehicle (optional)</option>
                {vehicles.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.registrationNumber} ({v.vehicleType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Deliveryman
              </label>
              <select
                value={selectedDeliveryman}
                onChange={(e) => setSelectedDeliveryman(e.target.value)}
                className="w-full text-xs rounded-md border border-input bg-background p-2 text-foreground"
              >
                <option value="">Select driver (optional)</option>
                {deliverymen.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} {d.phone ? `(${d.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                Select Confirmed Sales Orders ({selectedOrderIds.length} selected)
              </label>
              <span className="text-[10px] text-muted-foreground">Only confirmed orders eligible</span>
            </div>

            <div className="border rounded-lg max-h-56 overflow-y-auto divide-y bg-muted/20">
              {confirmedOrders.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No confirmed orders available for dispatch.
                </div>
              ) : (
                confirmedOrders.map((o) => {
                  const isChecked = selectedOrderIds.includes(o._id);
                  return (
                    <div
                      key={o._id}
                      onClick={() => toggleOrder(o._id)}
                      className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors ${
                        isChecked ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <div>
                          <div className="text-xs font-semibold font-mono text-foreground">
                            {o.orderNumber}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {o.customerId?.name || "Customer"} • {o.items?.length || 0} items
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-foreground">
                        ৳{(o.grandTotal || 0).toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded-md border border-input hover:bg-muted text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedOrderIds.length === 0}
              className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? "Creating..." : "Create Dispatch Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
