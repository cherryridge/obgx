import React, { ReactNode } from "react";
import { Tooltip } from "radix-ui";

import styles from "./styles.module.css";

interface HoverNoteProps {
    children: ReactNode;
    notes: ReactNode;
}

export default function HoverNote({ children, notes }: HoverNoteProps) {
    return (
        <Tooltip.Provider delayDuration={250}>
            <Tooltip.Root>
                <Tooltip.Trigger asChild>
                    <span
                        className={styles.trigger}
                        tabIndex={0}
                    >
                        {children}
                    </span>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        className={styles.content}
                        sideOffset={6}
                    >
                        {notes}
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    )
}