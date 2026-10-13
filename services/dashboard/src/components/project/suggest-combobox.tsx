'use client';

import { useId, useState } from 'react';

import { Input } from '@peretyn/ui/components/input';
import { Popover, PopoverAnchor, PopoverContent } from '@peretyn/ui/components/popover';
import { cn } from '@peretyn/ui/lib/utils';

type SuggestComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  id?: string;
  className?: string;
};

type ListNavigation = {
  matches: string[];
  active: number;
  setActive: (update: (index: number) => number) => void;
  choose: (item: string) => void;
};

type ComboboxKeyContext = {
  showList: boolean;
  setOpen: (open: boolean) => void;
  navigation: ListNavigation;
};

function filterSuggestions(suggestions: string[], value: string): string[] {
  const query = value.toLowerCase();
  return suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().startsWith(query) && suggestion.toLowerCase() !== query,
  );
}

function navigateList(event: React.KeyboardEvent<HTMLInputElement>, navigation: ListNavigation) {
  const { matches, active, setActive, choose } = navigation;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setActive((index) => (index + 1) % matches.length);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    setActive((index) => (index <= 0 ? matches.length - 1 : index - 1));
    return;
  }
  const item = active >= 0 ? matches[active] : undefined;
  if (event.key === 'Enter' && item) {
    event.preventDefault();
    choose(item);
  }
}

function handleComboboxKey(
  event: React.KeyboardEvent<HTMLInputElement>,
  { showList, setOpen, navigation }: ComboboxKeyContext,
) {
  if (event.key === 'Escape') {
    setOpen(false);
    return;
  }
  if (!showList) {
    if (event.key === 'ArrowDown') setOpen(true);
    return;
  }
  navigateList(event, navigation);
}

function useSuggestCombobox({
  value,
  onValueChange,
  suggestions,
}: Pick<SuggestComboboxProps, 'value' | 'onValueChange' | 'suggestions'>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const matches = filterSuggestions(suggestions, value);
  const showList = open && matches.length > 0;
  const activeId = active >= 0 && active < matches.length ? `${listId}-${active}` : undefined;

  const choose = (item: string) => {
    onValueChange(item);
    setActive(-1);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) =>
    handleComboboxKey(event, {
      showList,
      setOpen,
      navigation: { matches, active, setActive, choose },
    });

  const onInputChange = (next: string) => {
    onValueChange(next);
    setActive(-1);
    setOpen(true);
  };

  return {
    listId,
    matches,
    active,
    activeId,
    showList,
    setOpen,
    setActive,
    choose,
    onKeyDown,
    onInputChange,
  };
}

function SuggestionOption({
  optionId,
  item,
  isActive,
  onHover,
  onChoose,
}: {
  optionId: string;
  item: string;
  isActive: boolean;
  onHover: () => void;
  onChoose: (item: string) => void;
}) {
  return (
    <button
      id={optionId}
      type="button"
      role="option"
      aria-selected={isActive}
      onMouseDown={(e) => {
        e.preventDefault();
        onChoose(item);
      }}
      onClick={(e) => {
        e.preventDefault();
        onChoose(item);
      }}
      onMouseEnter={onHover}
      className={cn(
        'flex w-full items-center rounded-xl px-2 py-1.5 text-left font-mono text-sm',
        isActive && 'bg-accent text-accent-foreground',
      )}
    >
      {item}
    </button>
  );
}

function SuggestionList({
  listId,
  matches,
  active,
  setActive,
  choose,
}: {
  listId: string;
  matches: string[];
  active: number;
  setActive: (index: number) => void;
  choose: (item: string) => void;
}) {
  return (
    <PopoverContent
      onOpenAutoFocus={(e) => e.preventDefault()}
      align="start"
      id={listId}
      role="listbox"
      className="pointer-events-auto max-h-60 w-(--radix-popover-trigger-width) gap-0 overflow-y-auto rounded-2xl p-1"
    >
      {matches.map((item, i) => (
        <SuggestionOption
          key={item}
          optionId={`${listId}-${i}`}
          item={item}
          isActive={i === active}
          onHover={() => setActive(i)}
          onChoose={choose}
        />
      ))}
    </PopoverContent>
  );
}

export function SuggestCombobox({
  value,
  onValueChange,
  suggestions,
  placeholder,
  id,
  className,
}: SuggestComboboxProps) {
  const combobox = useSuggestCombobox({ value, onValueChange, suggestions });

  return (
    <Popover open={combobox.showList} onOpenChange={combobox.setOpen}>
      <PopoverAnchor asChild>
        <Input
          id={id}
          role="combobox"
          aria-expanded={combobox.showList}
          aria-controls={combobox.listId}
          aria-autocomplete="list"
          aria-activedescendant={combobox.activeId}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          className={className}
          onChange={(e) => combobox.onInputChange(e.target.value)}
          onFocus={() => combobox.setOpen(true)}
          onBlur={() => combobox.setOpen(false)}
          onKeyDown={combobox.onKeyDown}
        />
      </PopoverAnchor>
      {combobox.showList && <SuggestionList {...combobox} />}
    </Popover>
  );
}
