/**
 * Service Layer Abstractions
 * Adhering to Dependency Inversion Principle (DIP) and Interface Segregation (ISP)
 */

import { PaginationParams, PaginatedResult } from "./common";

// Customer Service Interface & DTOs
export interface CreateCustomerDTO {
  shopName: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  district?: string;
  area?: string;
  customerType?: "retailer" | "wholesaler" | "distributor" | "other";
  creditLimit?: number;
  openingBalance?: number;
  notes?: string;
  createdBy?: string;
}

export interface UpdateCustomerDTO extends Partial<CreateCustomerDTO> {
  status?: "active" | "inactive" | "suspended";
}

export interface CustomerQueryFilters extends PaginationParams {
  search?: string;
  district?: string;
  status?: string;
  customerType?: string;
}

export interface ICustomerService {
  list(filters: CustomerQueryFilters): Promise<PaginatedResult<unknown>>;
  getById(id: string): Promise<unknown | null>;
  create(data: CreateCustomerDTO, userId?: string): Promise<unknown>;
  update(id: string, data: UpdateCustomerDTO, userId?: string): Promise<unknown | null>;
  adjustReceivable(customerId: string, amount: number, session?: unknown): Promise<unknown>;
}

// Vendor Service Interface & DTOs
export interface CreateVendorDTO {
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  taxNumber?: string;
  openingBalance?: number;
  notes?: string;
  createdBy?: string;
}

export interface UpdateVendorDTO extends Partial<CreateVendorDTO> {
  status?: "active" | "inactive";
}

export interface VendorQueryFilters extends PaginationParams {
  search?: string;
  status?: string;
}

export interface IVendorService {
  list(filters: VendorQueryFilters): Promise<PaginatedResult<unknown>>;
  getById(id: string): Promise<unknown | null>;
  create(data: CreateVendorDTO, userId?: string): Promise<unknown>;
  update(id: string, data: UpdateVendorDTO, userId?: string): Promise<unknown | null>;
  adjustPayable(vendorId: string, amount: number, session?: unknown): Promise<unknown>;
}
