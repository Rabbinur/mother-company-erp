"use client";

import React, { useState, useEffect } from "react";
import { ProductHeader } from "@/components/products/ProductHeader";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductTable, ProductItem } from "@/components/products/ProductTable";
import { ProductCreateModal } from "@/components/products/ProductCreateModal";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [search, selectedCategory]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedCategory) params.append("categoryId", selectedCategory);

      const res = await fetch(`/api/v1/products?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProducts(json.data || []);
      }
    } catch (err) {
      console.error("Products fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/v1/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data || []);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <ProductHeader onAddNew={() => setShowCreateModal(true)} />

      <ProductFilters
        search={search}
        onSearchChange={setSearch}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={categories}
      />

      <ProductTable products={products} loading={loading} />

      <ProductCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        categories={categories}
        onCreated={fetchProducts}
      />
    </div>
  );
}
