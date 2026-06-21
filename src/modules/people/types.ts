export type PersonEntry = {
  id: number;
  name: string;
  role: string;
  status: string;
  contact: string;
  notes: string;
};

export type NewPersonEntry = Omit<PersonEntry, "id">;
