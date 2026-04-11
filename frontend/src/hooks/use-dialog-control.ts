import { useCallback, useState } from "react";

export interface UseDialogControlProps<TData = undefined> {
    isVisible: boolean;
    data: TData;
    show: (data?: TData) => void;
    hide: () => void;
}

export function useDialogControl<TData = undefined>(
    initialData?: TData,
): UseDialogControlProps<TData> {
    const [isVisible, setIsVisible] = useState(false);
    const [data, setData] = useState<TData>(initialData as TData);

    const show = useCallback((newData?: TData) => {
        if (newData !== undefined) setData(newData);
        setIsVisible(true);
    }, []);

    const hide = useCallback(() => {
        setIsVisible(false);
    }, []);

    return { isVisible, data, show, hide };
}
