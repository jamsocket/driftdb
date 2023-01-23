import { Action } from "driftdb/dist/types";
import { useCallback } from "react";
import IntInput from "./IntInput";

interface ActionInputProps {
    value: Action;
    onChange: (action: Action) => void;
}

export default function ActionInput(props: ActionInputProps): JSX.Element {
    const {onChange} = props
    
    const onChangeActionType = (e: React.ChangeEvent<HTMLSelectElement>) => {
        let action: Action;
        if (e.target.value === "compact") {
            action = {
                type: "compact",
                seq: 0,
            };
        } else {
            action = {type: e.target.value} as Action;
        }

        props.onChange(action);
    }

    const setCompactSeq = useCallback((seq: number) => {
        onChange({
            type: "compact",
            seq,
        });
    }, [onChange]);

    let dropDownValue: string
    if (typeof props.value === "string") {
        dropDownValue = props.value;
    } else {
        dropDownValue = props.value.type;
    }

    return <>
        <div className="flex-[2_2_0%]">
            <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2">
                Action
            </label>
            <select className="appearance-none block w-full bg-gray-200 text-gray-700 border rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white" id="grid-state" value={dropDownValue} onChange={onChangeActionType}>
                <option value="Relay">Relay</option>
                <option value="Append">Append</option>
                <option value="Replace">Replace</option>
                <option value="Compact">Compact</option>
            </select>
        </div>
        {
            dropDownValue === "Compact" ? <div className="flex-[1_1_0%]">
                <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2">
                    Seq
                </label>
                <IntInput value={(props.value as any).seq || 0} setValue={setCompactSeq} />
            </div> : null
        }
    </>
}
