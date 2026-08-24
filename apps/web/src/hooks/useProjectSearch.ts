import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@veylo/shared";
import { apiRequest } from "../lib/api";

interface UseProjectSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: Project[];
  isLoading: boolean;
  error: string | null;
  clearResults: () => void;
}

const DEBOUNCE_MS = 400;
const MIN_CHARS = 3;

export function useProjectSearch(): UseProjectSearchReturn {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<Project[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<Project[]>(
        `/auth/projects?q=${encodeURIComponent(q)}`,
        { signal: abortRef.current.signal },
      );
      setResults(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (q.trim().length < MIN_CHARS) {
        setResults([]);
        setError(null);
        return;
      }

      debounceRef.current = setTimeout(() => {
        doSearch(q.trim());
      }, DEBOUNCE_MS);
    },
    [doSearch],
  );

  const clearResults = useCallback(() => {
    setQueryState("");
    setResults([]);
    setError(null);
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { query, setQuery, results, isLoading, error, clearResults };
}
