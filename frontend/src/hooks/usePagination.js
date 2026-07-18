import { useEffect, useMemo, useState } from 'react';

// Client-side pagination over an already-filtered list.
// Returns the current page slice plus everything the Pagination control needs.
export default function usePagination(items, initialPerPage = 6) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPerPage);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);

  // Snap back into range when filters shrink the list.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(
    () => items.slice((safePage - 1) * perPage, safePage * perPage),
    [items, safePage, perPage]
  );

  return {
    paged,
    page: safePage,
    setPage,
    perPage,
    setPerPage: (value) => {
      setPerPage(value);
      setPage(1);
    },
    totalPages,
    total,
  };
}
