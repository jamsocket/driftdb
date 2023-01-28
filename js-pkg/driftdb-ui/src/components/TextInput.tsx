interface TextInputProps {
    placeholder?: string;
    value: string;
    setValue: (st: string) => void;
}

export default function TextInput(props: TextInputProps): JSX.Element {
    const input = (
        <input
            className="appearance-none block w-full bg-gray-200 text-gray-700 border rounded py-3 px-4 mb-3 leading-tight focus:outline-none focus:bg-white"
            type="text"
            placeholder={props.placeholder}
            value={props.value}
            onChange={(e) => props.setValue(e.target.value)}
        />
    )

    return input;
}