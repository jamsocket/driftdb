import { useEffect, useState } from 'react';
import { DbConnection } from 'driftdb';

interface StatusIndicatorProps {
    database: DbConnection;
}

export function StatusIndicator(props: StatusIndicatorProps) {
    const [status, setStatus] = useState(props.database.status);

    useEffect(
        () => {
            props.database.statusListener.addListener(setStatus);
            return () => {
                props.database.statusListener.removeListener(setStatus);
            };
        },
        [props.database.statusListener]
    )

    let parentClasses
    let dotClasses
    let message

    if (status.connected) {
        parentClasses = "bg-green-900 text-green-400";
        dotClasses = "bg-green-400";
        message = "Connected";
    } else {
        parentClasses = "bg-red-900 text-red-400";
        dotClasses = "bg-red-400";
        message = "Disconnected";
    }

    return <div className={`${parentClasses} rounded-full text-sm flex flex-row w-min items-center py-0.5 pl-1 space-x-1 pr-2`}>
        <div className={`${dotClasses} w-3.5 h-3.5 rounded-full`}></div>
        <span>{message}</span>
    </div>
}
