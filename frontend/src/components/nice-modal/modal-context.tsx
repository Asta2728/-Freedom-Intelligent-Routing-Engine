"use client";

/**
 * A simplified version of NiceModal with the core modal management functionality
 * without specific UI library integrations
 */

import React, {
    type JSX,
    type PropsWithChildren,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
} from "react";

// State interfaces
export interface NiceModalState {
    id: string;
    args?: Record<string, unknown>;
    visible?: boolean;
    delayVisible?: boolean;
    keepMounted?: boolean;
}

export interface NiceModalStore {
    [key: string]: NiceModalState;
}

export interface NiceModalAction {
    type: string;
    payload: {
        modalId: string;
        args?: Record<string, unknown>;
        flags?: Record<string, unknown>;
    };
}

// Callbacks for modal promises
interface NiceModalCallbacks {
    [modalId: string]: {
        resolve: (args: unknown) => void;
        reject: (args: unknown) => void;
        promise: Promise<unknown>;
    };
}

// Modal handler interface with better typing
export interface NiceModalHandler<
    Props = Record<string, unknown>,
> extends NiceModalState {
    /**
     * Whether a modal is visible
     */
    visible: boolean;
    /**
     * If you don't want to remove the modal from the tree after hide, set it to true.
     */
    keepMounted: boolean;
    /**
     * Show the modal, it will change visible state to true.
     * @param args - an object passed to modal component as props.
     */
    show: (args?: Props) => Promise<unknown>;
    /**
     * Hide the modal, it will change visible state to false.
     */
    hide: () => Promise<unknown>;
    /**
     * Resolve the promise returned by show method.
     */
    resolve: (args?: unknown) => void;
    /**
     * Reject the promise returned by show method.
     */
    reject: (args?: unknown) => void;
    /**
     * Remove the modal component from React component tree.
     */
    remove: () => void;
    /**
     * Resolve the promise returned by hide method.
     */
    resolveHide: (args?: unknown) => void;
}

// Props for HOC wrapper
export interface NiceModalHocProps {
    id?: string;
    defaultVisible?: boolean;
    keepMounted?: boolean;
}

export type NiceModalHocPropsExtended<T> = T & Omit<NiceModalHocProps, "id">;

// Symbol for modal ID
const symModalId = Symbol("NiceModalId");

// Initialize state and contexts
const initialState: NiceModalStore = {};
const NiceModalContext = React.createContext<NiceModalStore>(initialState);
const NiceModalIdContext = React.createContext<string | null>(null);

// Registry to keep track of modals with better typing
const MODAL_REGISTRY: {
    [id: string]: {
        comp: React.ComponentType<any>;
        props?: Record<string, unknown>;
    };
} = {};

// Track which modals are already mounted
const ALREADY_MOUNTED: Record<string, boolean> = {};

// UID generator for modals
let uidSeed = 0;
let dispatch: React.Dispatch<NiceModalAction> = () => {
    throw new Error(
        "No dispatch method detected, did you embed your app with NiceModal.Provider?",
    );
};
const getUid = (): string => `_nice_modal_${uidSeed++}`;

// Modal reducer for state management
export const reducer = (
    state: NiceModalStore,
    action: NiceModalAction,
): NiceModalStore => {
    switch (action.type) {
        case "nice-modal/show": {
            const { modalId, args } = action.payload;
            const existingModal = state[modalId];
            return {
                ...state,
                [modalId]: {
                    id: modalId,
                    args,
                    visible: !!ALREADY_MOUNTED[modalId],
                    delayVisible: !ALREADY_MOUNTED[modalId],
                    keepMounted: existingModal?.keepMounted || false,
                },
            };
        }
        case "nice-modal/hide": {
            const { modalId } = action.payload;
            if (!state[modalId]) return state;
            return {
                ...state,
                [modalId]: {
                    ...state[modalId]!,
                    visible: false,
                },
            };
        }
        case "nice-modal/remove": {
            const { modalId } = action.payload;
            const newState = { ...state };
            delete newState[modalId];
            return newState;
        }
        case "nice-modal/set-flags": {
            const { modalId, flags } = action.payload;
            if (!state[modalId]) return state;
            return {
                ...state,
                [modalId]: {
                    ...state[modalId]!,
                    ...flags,
                },
            };
        }
        default:
            return state;
    }
};

// Get modal component by ID
function getModal(modalId: string): React.ComponentType<any> | undefined {
    return MODAL_REGISTRY[modalId]?.comp;
}

// Action creators
function showModal(
    modalId: string,
    args?: Record<string, unknown>,
): NiceModalAction {
    return {
        type: "nice-modal/show",
        payload: {
            modalId,
            args,
        },
    };
}

function setModalFlags(
    modalId: string,
    flags: Record<string, unknown>,
): NiceModalAction {
    return {
        type: "nice-modal/set-flags",
        payload: {
            modalId,
            flags,
        },
    };
}

function hideModal(modalId: string): NiceModalAction {
    return {
        type: "nice-modal/hide",
        payload: {
            modalId,
        },
    };
}

function removeModal(modalId: string): NiceModalAction {
    return {
        type: "nice-modal/remove",
        payload: {
            modalId,
        },
    };
}

// Callbacks storage
const modalCallbacks: NiceModalCallbacks = {};
const hideModalCallbacks: NiceModalCallbacks = {};

// Get or create modal ID
const getModalId = (modal: string | React.ComponentType<any>): string => {
    if (typeof modal === "string") return modal as string;
    if (!(modal as any)[symModalId]) {
        (modal as any)[symModalId] = getUid();
    }
    return (modal as any)[symModalId];
};

// Type helpers for show function
export type NiceModalArgs<T> = T extends
    | keyof JSX.IntrinsicElements
    | React.JSXElementConstructor<any>
    ? React.ComponentProps<T>
    : Record<string, unknown>;

// Show modal function with overloads for different types
export function show<
    C extends React.ComponentType<any>,
    T = C extends { __niceReturn?: (args: never) => infer R } ? R : unknown,
    P extends Partial<NiceModalArgs<C>> = Partial<NiceModalArgs<C>>,
>(modal: C, args?: P): Promise<T>;

export function show<T>(
    modal: string,
    args?: Record<string, unknown>,
): Promise<T>;
export function show<T, P>(modal: string, args: P): Promise<T>;

export function show(
    modal: React.ComponentType<any> | string,
    args?: NiceModalArgs<React.ComponentType<any>> | Record<string, unknown>,
): Promise<unknown> {
    const modalId = getModalId(modal);
    if (typeof modal !== "string" && !MODAL_REGISTRY[modalId]) {
        register(modalId, modal as React.ComponentType);
    }

    dispatch(showModal(modalId, args));
    if (!modalCallbacks[modalId]) {
        let theResolve!: (args?: unknown) => void;
        let theReject!: (args?: unknown) => void;
        const promise = new Promise<unknown>((resolve, reject) => {
            theResolve = resolve;
            theReject = reject;
        });
        modalCallbacks[modalId] = {
            resolve: theResolve,
            reject: theReject,
            promise,
        };
    }
    return modalCallbacks[modalId].promise;
}

// Hide modal function
export function hide<T>(modal: string | React.ComponentType<any>): Promise<T>;
export function hide(
    modal: string | React.ComponentType<any>,
): Promise<unknown> {
    const modalId = getModalId(modal);
    dispatch(hideModal(modalId));
    // Delete the callback for modal.resolve
    delete modalCallbacks[modalId];
    if (!hideModalCallbacks[modalId]) {
        let theResolve!: (args?: unknown) => void;
        let theReject!: (args?: unknown) => void;
        const promise = new Promise<unknown>((resolve, reject) => {
            theResolve = resolve;
            theReject = reject;
        });
        hideModalCallbacks[modalId] = {
            resolve: theResolve,
            reject: theReject,
            promise,
        };
    }
    return hideModalCallbacks[modalId].promise;
}

// Remove modal function
export const remove = (modal: string | React.ComponentType<any>): void => {
    const modalId = getModalId(modal);
    dispatch(removeModal(modalId));
    delete modalCallbacks[modalId];
    delete hideModalCallbacks[modalId];
};

// Set flags for a modal
const setFlags = (modalId: string, flags: Record<string, unknown>): void => {
    dispatch(setModalFlags(modalId, flags));
};

// useModal hook with overloads
export function useModal(): NiceModalHandler;
export function useModal(
    modal: string,
    args?: Record<string, unknown>,
): NiceModalHandler;
export function useModal<
    C,
    P extends Partial<NiceModalArgs<React.ComponentType<C>>>,
>(
    modal: React.ComponentType<C>,
    args?: P,
): Omit<NiceModalHandler, "show"> & {
    show: <
        T = C extends { __niceReturn?: (args: never) => infer R } ? R : unknown,
    >(
        args?: P,
    ) => Promise<T>;
};

export function useModal(
    modal?: string | React.ComponentType<any>,
    args?: Record<string, unknown>,
):
    | NiceModalHandler
    | (Omit<NiceModalHandler, "show"> & {
        show: (args?: Record<string, unknown>) => Promise<unknown>;
    }) {
    const modals = useContext(NiceModalContext);
    const contextModalId = useContext(NiceModalIdContext);
    let modalId: string | null = null;
    const isUseComponent = modal && typeof modal !== "string";

    if (!modal) {
        modalId = contextModalId;
    } else {
        modalId = getModalId(modal);
    }

    // Only if contextModalId doesn't exist
    if (!modalId) throw new Error("No modal id found in NiceModal.useModal.");

    const mid = modalId as string;
    // If use a component directly, register it.
    useEffect(() => {
        if (isUseComponent && !MODAL_REGISTRY[mid]) {
            register(mid, modal as React.ComponentType, args);
        }
    }, [isUseComponent, mid, modal, args]);

    const modalInfo = modals[mid];

    const showCallback = useCallback(
        (args?: Record<string, unknown>) => show(mid, args),
        [mid],
    );
    const hideCallback = useCallback(() => hide(mid), [mid]);
    const removeCallback = useCallback(() => remove(mid), [mid]);
    const resolveCallback = useCallback(
        (args?: unknown) => {
            modalCallbacks[mid]?.resolve(args);
            delete modalCallbacks[mid];
        },
        [mid],
    );
    const rejectCallback = useCallback(
        (args?: unknown) => {
            modalCallbacks[mid]?.reject(args);
            delete modalCallbacks[mid];
        },
        [mid],
    );
    const resolveHide = useCallback(
        (args?: unknown) => {
            hideModalCallbacks[mid]?.resolve(args);
            delete hideModalCallbacks[mid];
        },
        [mid],
    );

    return useMemo(
        () => ({
            id: mid,
            args: modalInfo?.args,
            visible: !!modalInfo?.visible,
            keepMounted: !!modalInfo?.keepMounted,
            show: showCallback,
            hide: hideCallback,
            remove: removeCallback,
            resolve: resolveCallback,
            reject: rejectCallback,
            resolveHide,
        }),
        [
            mid,
            modalInfo?.args,
            modalInfo?.visible,
            modalInfo?.keepMounted,
            showCallback,
            hideCallback,
            removeCallback,
            resolveCallback,
            rejectCallback,
            resolveHide,
        ],
    );
}

// HOC creator for modal components
export const create = <P extends NiceModalHocProps, TReturn = unknown>(
    Comp: React.ComponentType<P>,
): React.ComponentType<P & NiceModalHocProps> & {
    __niceReturn?: (args: never) => TReturn;
} => {
    // eslint-disable-next-line react/display-name
    return ({ defaultVisible, keepMounted, ...props }) => {
        const id = props.id!;
        const { args, show } = useModal(id);

        // If there's modal state, then should mount it.
        const modals = useContext(NiceModalContext);
        const shouldMount = !!modals[id];

        useEffect(() => {
            // If defaultVisible, show it after mounted.
            if (defaultVisible) {
                show();
            }

            ALREADY_MOUNTED[id] = true;

            return () => {
                delete ALREADY_MOUNTED[id];
            };
        }, [id, show, defaultVisible]);

        useEffect(() => {
            if (keepMounted) setFlags(id, { keepMounted: true });
        }, [id, keepMounted]);

        const delayVisible = modals[id]?.delayVisible;
        // Handle delayed visibility
        useEffect(() => {
            if (delayVisible) {
                // delayVisible: false => true, it means the modal.show() is called, should show it.
                show(args);
            }
        }, [delayVisible, args, show]);

        if (!shouldMount) return null;
        return (
            <NiceModalIdContext.Provider value={id}>
                <Comp {...(props as P)} {...args} />
            </NiceModalIdContext.Provider>
        );
    };
};

// Register a modal
export const register = <T extends React.ComponentType<any>>(
    id: string,
    comp: T,
    props?: Partial<NiceModalArgs<T>>,
): void => {
    if (!MODAL_REGISTRY[id]) {
        MODAL_REGISTRY[id] = { comp, props };
    } else {
        MODAL_REGISTRY[id].props = props;
    }
};

// Unregister a modal
export const unregister = (id: string): void => {
    delete MODAL_REGISTRY[id];
};

// Modal placeholder component to render registered modals
const NiceModalPlaceholder: React.FC = () => {
    const modals = useContext(NiceModalContext);
    const visibleModalIds = Object.keys(modals).filter((id) => !!modals[id]);

    visibleModalIds.forEach((id) => {
        if (!MODAL_REGISTRY[id] && !ALREADY_MOUNTED[id]) {
            console.warn(
                `No modal found for id: ${id}. Please check the id or if it is registered or declared via JSX.`,
            );
            return;
        }
    });

    const toRender = visibleModalIds
        .filter((id) => MODAL_REGISTRY[id])
        .map((id) => ({
            id,
            ...MODAL_REGISTRY[id],
        }));

    return (
        <>
            {toRender.map((t) => {
                if (!t.comp) return null;
                const Component = t.comp;
                return <Component key={t.id} id={t.id} {...t.props} />;
            })}
        </>
    );
};

// Context provider component
const InnerContextProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const arr = useReducer(reducer, initialState);
    const modals = arr[0];
    dispatch = arr[1];
    return (
        <NiceModalContext.Provider value={modals}>
            {children}
            <NiceModalPlaceholder />
        </NiceModalContext.Provider>
    );
};

// Provider component with optional external state management
export const Provider = ({
    children,
    dispatch: givenDispatch,
    modals: givenModals,
}: {
    children: ReactNode;
    dispatch?: React.Dispatch<NiceModalAction>;
    modals?: NiceModalStore;
}) => {
    if (!givenDispatch || !givenModals) {
        return <InnerContextProvider>{children}</InnerContextProvider>;
    }
    dispatch = givenDispatch;
    return (
        <NiceModalContext.Provider value={givenModals}>
            {children}
            <NiceModalPlaceholder />
        </NiceModalContext.Provider>
    );
};

// Component for declarative modal registration
export const ModalDef = ({
    id,
    component,
}: {
    id: string;
    component: React.ComponentType<any>;
}) => {
    useEffect(() => {
        register(id, component);
        return () => {
            unregister(id);
        };
    }, [id, component]);
    return null;
};

// Modal holder component for binding props and control
export const ModalHolder = <
    T extends Record<string, unknown> = Record<string, unknown>,
>({
    modal,
    handler,
    ...restProps
}: {
    modal: string | React.ComponentType<any>;
    handler: {
        show?: (args?: T) => Promise<unknown>;
        hide?: () => Promise<unknown>;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}) => {
    const mid = useMemo(() => getUid(), []);
    const ModalComp =
        typeof modal === "string" ? MODAL_REGISTRY[modal]?.comp : modal;

    if (!handler) {
        throw new Error("No handler found in NiceModal.ModalHolder.");
    }
    if (!ModalComp) {
        throw new Error(
            `No modal found for id: ${modal} in NiceModal.ModalHolder.`,
        );
    }
    handler.show = useCallback((args?: T) => show(mid, args), [mid]);
    handler.hide = useCallback(() => hide(mid), [mid]);

    return <ModalComp id={mid} {...restProps} />;
};

// Helper for creating modal handlers with TypeScript support
export function createModalHandler<
    T extends React.ComponentType<any>,
    TReturnType = unknown,
>(): {
    show: (
        args?: Omit<React.ComponentProps<T>, keyof NiceModalHocProps>,
    ) => Promise<TReturnType>;
    hide: () => void;
} {
    return Object.create(null);
}

// Main exports
const NiceModal = {
    Provider,
    ModalDef,
    ModalHolder,
    NiceModalContext,
    create,
    register,
    getModal,
    show,
    hide,
    remove,
    useModal,
    reducer,
};

export default NiceModal;