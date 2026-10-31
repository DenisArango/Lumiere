import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPeople, fetchPersonById, updatePerson } from "@/features/people/people.api";
import type { UpdatePersonInput } from "@/features/people/people.types";

export function usePeople(params: { search?: string; page?: number }) {
  return useQuery({
    queryKey: ["people", params],
    queryFn: () => fetchPeople(params),
    placeholderData: (previous) => previous,
  });
}

export function usePerson(id: string | undefined) {
  return useQuery({
    queryKey: ["person", id],
    queryFn: () => fetchPersonById(id as string),
    enabled: Boolean(id),
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePersonInput }) => updatePerson(id, input),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["people"] });
      void queryClient.invalidateQueries({ queryKey: ["person", id] });
    },
  });
}
