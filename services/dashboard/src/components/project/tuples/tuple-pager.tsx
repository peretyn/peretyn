'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@peretyn/ui/components/button';
import type { TuplePage } from './use-tuple-page';

export function TuplePager({
  page,
  hasNext,
  goNext,
  goPrevious,
}: Pick<TuplePage, 'page' | 'hasNext' | 'goNext' | 'goPrevious'>) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Page {page + 1}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={goPrevious}>
          <ChevronLeftIcon />
          Prev
        </Button>
        <Button variant="outline" size="sm" disabled={!hasNext} onClick={goNext}>
          Next
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
