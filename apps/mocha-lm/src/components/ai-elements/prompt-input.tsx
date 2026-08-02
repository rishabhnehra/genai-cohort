"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/ui/input-group";
import { cn } from "@/lib/utils";
import type { ChatStatus } from "ai";
import { Loader2Icon, SendIcon, SquareIcon } from "lucide-react";
import type {
  ChangeEvent,
  ComponentProps,
  FormEventHandler,
  HTMLAttributes,
  KeyboardEventHandler,
  PropsWithChildren,
} from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface TextInputContext {
  value: string;
  setInput: (v: string) => void;
  clear: () => void;
}

export interface PromptInputControllerProps {
  textInput: TextInputContext;
}

const PromptInputController = createContext<PromptInputControllerProps | null>(null);

export const usePromptInputController = () => {
  const ctx = useContext(PromptInputController);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside PromptInputProvider to use usePromptInputController().",
    );
  }
  return ctx;
};

const useOptionalPromptInputController = () => useContext(PromptInputController);

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
}>;

export const PromptInputProvider = ({
  initialInput: initialTextInput = "",
  children,
}: PromptInputProviderProps) => {
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  const controller = useMemo(
    () => ({
      textInput: {
        clear: clearInput,
        setInput: setTextInput,
        value: textInput,
      },
    }),
    [textInput, clearInput],
  );

  return (
    <PromptInputController.Provider value={controller}>{children}</PromptInputController.Provider>
  );
};

export interface PromptInputMessage {
  text: string;
}

export type PromptInputProps = Omit<HTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  onSubmit: (message: PromptInputMessage) => void | Promise<void>;
};

export const PromptInput = ({
  className,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const controller = useOptionalPromptInputController();

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const text = controller
        ? controller.textInput.value
        : ((new FormData(form).get("message") as string) || "");

      if (!text.trim()) {
        return;
      }

      try {
        await onSubmit({ text: text.trim() });
        if (controller) {
          controller.textInput.clear();
        } else {
          form.reset();
        }
      } catch {
        // Keep input on error so the user can retry.
      }
    },
    [controller, onSubmit],
  );

  return (
    <form className={cn("w-full", className)} onSubmit={handleSubmit} {...props}>
      {children}
    </form>
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <InputGroup className={cn("h-auto min-h-10 items-end", className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>;

export const PromptInputTextarea = ({
  onChange,
  onKeyDown,
  className,
  placeholder = "What would you like to know?",
  disabled,
  ...props
}: PromptInputTextareaProps) => {
  const controller = useOptionalPromptInputController();
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "Enter") {
        if (isComposing || event.nativeEvent.isComposing) {
          return;
        }
        if (event.shiftKey) {
          return;
        }
        event.preventDefault();

        const form = event.currentTarget.form;
        const submitButton = form?.querySelector(
          'button[type="submit"]',
        ) as HTMLButtonElement | null;
        if (submitButton?.disabled) {
          return;
        }
        form?.requestSubmit();
      }
    },
    [onKeyDown, isComposing],
  );

  const controlledProps = controller
    ? {
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
          controller.textInput.setInput(event.currentTarget.value);
          onChange?.(event);
        },
        value: controller.textInput.value,
      }
    : { onChange };

  return (
    <InputGroupTextarea
      className={cn(
        "field-sizing-content min-h-10 max-h-48 py-2.5 text-base leading-relaxed md:text-base",
        className,
      )}
      disabled={disabled}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
      {...controlledProps}
    />
  );
};

export type PromptInputFooterProps = ComponentProps<typeof InputGroupAddon>;

export const PromptInputFooter = ({
  className,
  align = "inline-end",
  ...props
}: PromptInputFooterProps) => (
  <InputGroupAddon align={align} className={cn("self-end pb-2 pr-2", className)} {...props} />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  children,
  disabled,
  ...props
}: PromptInputSubmitProps) => {
  const isStoppable = (status === "streaming" || status === "submitted") && onStop;

  if (isStoppable) {
    return (
      <InputGroupButton
        aria-label="Stop"
        className={cn(className)}
        disabled={false}
        onClick={() => onStop()}
        size={size}
        type="button"
        variant={variant}
        {...props}
      >
        {children ??
          (status === "submitted" ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SquareIcon className="size-4" />
          ))}
      </InputGroupButton>
    );
  }

  return (
    <InputGroupButton
      aria-label="Submit"
      className={cn(className)}
      disabled={disabled || status === "submitted" || status === "streaming"}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? <SendIcon className="size-4" />}
    </InputGroupButton>
  );
};
