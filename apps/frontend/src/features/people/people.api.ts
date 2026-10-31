import { apiClient } from "@/lib/api-client";
import type { PaginatedResult } from "@/features/movies/movies.types";
import type {
  CreatePersonInput,
  Person,
  PersonDetail,
  PersonSummary,
  UpdatePersonInput,
} from "@/features/people/people.types";

export async function searchPeople(search: string): Promise<PersonSummary[]> {
  const { data } = await apiClient.get<PaginatedResult<PersonSummary>>("/people", {
    params: { search: search || undefined, pageSize: 10 },
  });
  return data.items;
}

export async function createPerson(input: CreatePersonInput): Promise<PersonSummary> {
  const { data } = await apiClient.post<{ person: PersonSummary }>("/people", input);
  return data.person;
}

export async function fetchPeople(params: { search?: string; page?: number }): Promise<PaginatedResult<Person>> {
  const { data } = await apiClient.get<PaginatedResult<Person>>("/people", {
    params: { search: params.search || undefined, page: params.page, pageSize: 20 },
  });
  return data;
}

export async function fetchPersonById(id: string): Promise<PersonDetail> {
  const { data } = await apiClient.get<{ person: PersonDetail }>(`/people/${id}`);
  return data.person;
}

export async function updatePerson(id: string, input: UpdatePersonInput): Promise<Person> {
  const { data } = await apiClient.patch<{ person: Person }>(`/people/${id}`, input);
  return data.person;
}
