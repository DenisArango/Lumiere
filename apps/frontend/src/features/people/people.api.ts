import { apiClient } from "@/lib/api-client";
import type { PaginatedResult } from "@/features/movies/movies.types";
import type { CreatePersonInput, PersonSummary } from "@/features/people/people.types";

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
