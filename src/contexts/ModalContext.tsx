import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

interface ModalOptions {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    defaultValue?: string;
    destructive?: boolean;
}

interface ModalContextType {
    showAlert: (message: string, options?: ModalOptions) => Promise<void>;
    showConfirm: (message: string, options?: ModalOptions) => Promise<boolean>;
    showPrompt: (message: string, options?: ModalOptions) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        type: 'alert' | 'confirm' | 'prompt';
        message: string;
        options: ModalOptions;
        resolve: (value: any) => void;
    } | null>(null);

    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when prompt opens
    React.useEffect(() => {
        if (modalState?.type === 'prompt' && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [modalState?.type]);

    const showAlert = useCallback((message: string, options: ModalOptions = {}) => {
        return new Promise<void>((resolve) => {
            setModalState({
                isOpen: true,
                type: 'alert',
                message,
                options: { title: 'Alert', confirmLabel: 'OK', ...options },
                resolve: () => {
                    setModalState(null);
                    resolve();
                }
            });
        });
    }, []);

    const showConfirm = useCallback((message: string, options: ModalOptions = {}) => {
        return new Promise<boolean>((resolve) => {
            setModalState({
                isOpen: true,
                type: 'confirm',
                message,
                options: { title: 'Confirm', confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...options },
                resolve: (result: boolean) => {
                    setModalState(null);
                    resolve(result);
                }
            });
        });
    }, []);

    const showPrompt = useCallback((message: string, options: ModalOptions = {}) => {
        setInputValue(options.defaultValue || '');
        return new Promise<string | null>((resolve) => {
            setModalState({
                isOpen: true,
                type: 'prompt',
                message,
                options: { title: 'Input', confirmLabel: 'OK', cancelLabel: 'Cancel', ...options },
                resolve: (result: string | null) => {
                    setModalState(null);
                    resolve(result);
                }
            });
        });
    }, []);

    const handleClose = () => {
        if (modalState) {
            if (modalState.type === 'confirm') {
                modalState.resolve(false);
            } else if (modalState.type === 'prompt') {
                modalState.resolve(null);
            } else {
                modalState.resolve(undefined);
            }
        }
    };

    const handleConfirm = () => {
        if (modalState) {
            if (modalState.type === 'confirm') {
                modalState.resolve(true);
            } else if (modalState.type === 'prompt') {
                modalState.resolve(inputValue);
            } else {
                modalState.resolve(undefined);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        }
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
            {children}
            {modalState && (
                <Modal
                    isOpen={modalState.isOpen}
                    onClose={handleClose}
                    title={modalState.options.title || 'Notification'}
                    footer={
                        <>
                            {(modalState.type === 'confirm' || modalState.type === 'prompt') && (
                                <Button variant="secondary" onClick={handleClose}>
                                    {modalState.options.cancelLabel}
                                </Button>
                            )}
                            <Button
                                variant={modalState.options.destructive ? 'danger' : 'primary'}
                                onClick={handleConfirm}
                            >
                                {modalState.options.confirmLabel}
                            </Button>
                        </>
                    }
                >
                    <p className="mb-4">{modalState.message}</p>
                    {modalState.type === 'prompt' && (
                        <Input
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full"
                            placeholder="Enter value..."
                        />
                    )}
                </Modal>
            )}
        </ModalContext.Provider>
    );
};

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
};
