"use client";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { PopoverClose } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Edit, LoaderIcon, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Props<T extends object> {
    title?: string;
    // value?: T | T[]; // single OR multiple
    valueKey: keyof T;
    multiple?: boolean;
    disabled?: boolean;
    size?: number;
    renderText: (value: T) => string;
    // onChange?: (value: T | T[]) => void;
    searchFn: (search: string, offset: number, size: number) => Promise<T[]>;
    // New props for creation and editing
    onCreateClick?: () => void;
    onEditClick?: (item: T) => void;
    showCreateButton?: boolean;
    showEditButton?: boolean;
    placeholder?: string;
}

type PropsMultiple<T extends object> = Props<T> & {
    value?: T[];
    multiple: true;
    onChange?: (value: T | T[]) => void;
}

type PropsSingle<T extends object> = Props<T> & {
    value?: T;
    multiple: false;
    onChange?: (value: T) => void;
}

const ComboBox2 = <T extends object>({
    title,
    value,
    valueKey,
    multiple = false,
    disabled = false,
    size = 25,
    renderText,
    onChange,
    searchFn,
    onCreateClick,
    onEditClick,
    showCreateButton = false,
    showEditButton = false,
    placeholder = "Search...",
}: PropsMultiple<T> | PropsSingle<T>) => {
    const [search, setSearch] = useState<string>("");
    const [options, setOptions] = useState<T[]>([]);
    const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
    const debouncedsearch = useDebounce<string>(search, 500);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isOpen, setIsOpen] = useState(false);

    const getOptions = useCallback(async () => {
        setIsLoading(true);
        const searchResult = await searchFn(debouncedsearch || "", 0, size);
        if (searchResult.length === 0 || searchResult.length < size) {
            setCanLoadMore(false);
        } else {
            setCanLoadMore(true);
        }
        setOptions(searchResult);
        setIsLoading(false);
    }, [debouncedsearch, searchFn, size]);

    const getMoreOptions = useCallback(async () => {
        setIsLoading(true);
        const searchResult = await searchFn(
            debouncedsearch || "",
            options.length,
            size,
        );
        if (searchResult.length === 0 || searchResult.length < size) {
            setCanLoadMore(false);
        }
        if (
            options.length > 0 &&
            searchResult[searchResult.length - 1]?.[valueKey] ===
            options[options.length - 1]?.[valueKey]
        ) {
            setCanLoadMore(false);
            return;
        }
        // Filter out possible duplicates
        const newOptions = searchResult.filter(
            newOpt => !options.some(existing => existing[valueKey] === newOpt[valueKey])
        );
        setOptions(prev => [...prev, ...newOptions]);
        setIsLoading(false);
    }, [debouncedsearch, searchFn, options, valueKey, size]);

    const handleSelect = useCallback((option: T) => {
        if (multiple) {
            const current = Array.isArray(value) ? value : [];
            const exists = current.some(v => v[valueKey] === option[valueKey]);
            const newValue = exists
                ? current.filter(v => v[valueKey] !== option[valueKey])
                : [...current, option];
            onChange?.(newValue as any);
        } else {
            onChange?.(option);
            setIsOpen(false);
        }
    }, [multiple, value, valueKey, onChange]);

    const handleCreateClick = useCallback(() => {
        onCreateClick?.();
        setIsOpen(false);
    }, [onCreateClick]);

    const handleEditClick = useCallback((item: T) => {
        onEditClick?.(item);
        setIsOpen(false);
    }, [onEditClick]);

    useEffect(() => {
        if (isOpen) {
            getOptions();
        }
    }, [getOptions, isOpen]);

    // Update internal search state if popover closes
    useEffect(() => {
        if (!isOpen) {
            setSearch("");
        }
    }, [isOpen]);

    return (
        <Popover modal={true} open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-between",
                        (!value || (Array.isArray(value) && value.length === 0)) && "text-muted-foreground",
                    )}
                    disabled={disabled}
                >
                    <div className="truncate">
                        {multiple
                            ? Array.isArray(value) && value.length > 0
                                ? value.map(renderText).join(", ")
                                : `${title}`
                            : value
                                ? renderText(value as T)
                                : `${title}`}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="PopoverContent p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={placeholder}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>No item found.</CommandEmpty>
                        <CommandGroup className="max-h-60 overflow-y-auto">
                            {/* Create button */}
                            {showCreateButton && onCreateClick && (
                                <CommandItem
                                    onSelect={handleCreateClick}
                                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create New
                                </CommandItem>
                            )}

                            {/* Options list */}
                            {options.map((option) => (
                                <CommandItem
                                    value={String(option[valueKey])}
                                    key={String(option[valueKey])}
                                    onSelect={() => handleSelect(option)}
                                    className="flex items-center justify-between group"
                                >
                                    <div className="flex items-center flex-1 pr-2 truncate">
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4 shrink-0",
                                                multiple
                                                    ? (Array.isArray(value) && value.some(v => v[valueKey] === option[valueKey]))
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                    : (value as T)?.[valueKey] === option[valueKey]
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                            )}
                                        />
                                        <span className="truncate">{renderText(option)}</span>
                                    </div>

                                    {/* Edit button */}
                                    {showEditButton && onEditClick && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditClick(option);
                                            }}
                                        >
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                    )}
                                </CommandItem>
                            ))}

                            {canLoadMore && (
                                <CommandItem asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full h-7 mt-1 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            getMoreOptions();
                                        }}
                                        disabled={isLoading}
                                    >
                                        {isLoading
                                            ? <LoaderIcon className="w-4 h-4 animate-spin" />
                                            : "Load More ↓"}
                                    </Button>
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default ComboBox2;
