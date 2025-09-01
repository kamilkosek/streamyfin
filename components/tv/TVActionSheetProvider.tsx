import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  type TVActionSheetProps,
  type TVActionSheetRef,
  TVModalActionSheet,
} from "./TVModalActionSheet";

interface TVActionSheetContextValue {
  showActionSheet: (props: Omit<TVActionSheetProps, "visible">) => void;
  hideActionSheet: () => void;
}

const TVActionSheetContext = createContext<TVActionSheetContextValue | null>(
  null,
);

interface TVActionSheetProviderProps {
  children: ReactNode;
}

export const TVActionSheetProvider: React.FC<TVActionSheetProviderProps> = ({
  children,
}) => {
  const actionSheetRef = useRef<TVActionSheetRef>(null);
  const [currentProps, setCurrentProps] = useState<TVActionSheetProps | null>(
    null,
  );

  const showActionSheet = useCallback(
    (props: Omit<TVActionSheetProps, "visible">) => {
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
    <TVActionSheetContext.Provider value={{ showActionSheet, hideActionSheet }}>
      {children}
      {currentProps && (
        <TVModalActionSheet
          ref={actionSheetRef}
          {...currentProps}
          onCancel={handleCancel}
          onDismiss={handleDismiss}
        />
      )}
    </TVActionSheetContext.Provider>
  );
};

export const useTVActionSheet = (): TVActionSheetContextValue => {
  const context = useContext(TVActionSheetContext);
  if (!context) {
    throw new Error(
      "useTVActionSheet must be used within a TVActionSheetProvider",
    );
  }
  return context;
};
