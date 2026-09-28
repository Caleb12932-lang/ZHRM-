import { useQuery } from "@tanstack/react-query";
import { hr } from "@/lib/hr";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: hr.me, staleTime: 60_000 });
}
