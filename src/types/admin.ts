export interface AdminManifest {
  product: '0nbox' | 'strive' | 'parcours' | 'sara' | 'fluid';
  resources: AdminResourceMeta[]; // registry order
}

export interface AdminResourceMeta {
  key: string; // 'medal-claims'
  label: string; // 'Medal claims'
  singular: string; // 'Medal claim'
  model: string; // 'MedalClaim'
  group: string; // nav group, from §7.2
  titleField: string; // the field that names a record
  columns: string[]; // table columns, in order
  searchable: string[];
  sortable: string[];
  filterable: string[];
  defaultSort: { by: string; order: 'asc' | 'desc' };
  can: { create: boolean; update: boolean; delete: boolean };
  note: string | null; // shown above the table, in the record view and in the form modal
  count: number; // rows in the table now
  fields: AdminFieldMeta[]; // exposed fields, in schema order
  related: { resource: string; field: string }[]; // resources whose `field` points at this one
}

export interface AdminFieldMeta {
  name: string;
  label: string; // 'emailVerifiedAt' → 'Email verified at'
  type: 'string' | 'text' | 'int' | 'float' | 'decimal' | 'boolean' | 'datetime' | 'enum' | 'json';
  list: boolean; // a scalar list: String[], Int[]
  required: boolean; // must be given on create
  nullable: boolean;
  readOnly: boolean; // shown, never accepted
  isId: boolean;
  enumValues: string[] | null;
  relation: { resource: string } | null; // a foreign key to a registered resource
}

export type AdminRef = { key: string; title: string };

export type AdminRecord = Record<string, unknown> & {
  _key: string; // opaque: the dashboard never builds one
  _title: string; // the title field's value; _key when that's empty
  _refs: Record<string, AdminRef | null>; // per foreign key: the record it points at
};

export type ApiResponse<T> = { status: number; message: string; data: T; success?: boolean };

export type PaginatedApiResponse<T> = ApiResponse<T> & {
  total: number;
  page: number;
  size: number;
  totalPages: number;
};

export type ListParams = {
  page: number;
  size: number;
  query?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters: Record<string, string>;
};
