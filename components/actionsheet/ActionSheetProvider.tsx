import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  type ActionSheetProps,
  type ActionSheetRef,
  ModalActionSheet,
} from "./ModalActionSheet";

interface ActionSheetContextValue {
  showActionSheet: (props: Omit<ActionSheetProps, "visible">) => void;
  hideActionSheet: () => void;
}

const ActionSheetContext = createContext<ActionSheetContextValue | null>(null);

interface ActionSheetProviderProps {
  children: ReactNode;
}

export const ActionSheetProvider: React.FC<ActionSheetProviderProps> = ({
  children,
}) => {
  const actionSheetRef = useRef<ActionSheetRef>(null);
  const [currentProps, setCurrentProps] = useState<ActionSheetProps | null>(
    null,
  );

  const showActionSheet = useCallback(
    (props: Omit<ActionSheetProps, "visible">) => {
      setCurrentProps({ ...props, visible: true });
    },
    [],
  );

  const hideActionSheet = useCallback(() => {
    setCurrentProps((prev) => (prev ? { ...prev, visible: false } : null));
  }, []);

  const handleDismiss = useCallback(() => {
    // Delay clearing props to allow hide animation to complete
    setTimeout(() => {
      setCurrentProps(null);
    }, 50);
  }, []);

  const handleCancel = useCallback(() => {
    currentProps?.onCancel?.();
    hideActionSheet();
  }, [currentProps, hideActionSheet]);

  return (
    <ActionSheetContext.Provider value={{ showActionSheet, hideActionSheet }}>
      {children}
      {currentProps && (
        <ModalActionSheet
          ref={actionSheetRef}
          {...currentProps}
          onCancel={handleCancel}
          onDismiss={handleDismiss}
        />
      )}
    </ActionSheetContext.Provider>
  );
};

export const useActionSheet = (): ActionSheetContextValue => {
  const context = useContext(ActionSheetContext);
  if (!context) {
    throw new Error("useActionSheet must be used within a ActionSheetProvider");
  }
  return context;
};
