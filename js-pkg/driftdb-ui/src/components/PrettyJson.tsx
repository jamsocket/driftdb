import { Fragment } from "react";

export default function PrettyJson(props: { value: any }) {
  const typ = typeof props.value;

  switch (typ) {
    case "string":
      return <><span className="text-gray-400">"</span><span className="text-green-600 font-bold">{props.value}</span><span className="text-gray-400">"</span></>;
    case "number":
      return <span className="text-blue-500 font-bold">{props.value}</span>;
    case "boolean":
      return <span className="text-sky-500 font-bold">{props.value.toString()}</span>;
    case "object":
      if (props.value === null) {
        return <span className="text-red-500">null</span>;
      } else if (Array.isArray(props.value)) {
        return (
          <span>
            [
            {props.value.map((v, i) => (
              <span key={i}>
                <PrettyJson value={v} />
                {i === props.value.length - 1 ? "" : <span className="text-gray-400">, </span>}
              </span>
            ))}
            ]
          </span>
        );
      } else {
        return (
          <span>
            {"{"}
            {
              Object.entries(props.value).map(([k, v], i) => (
                <Fragment key={k}>
                  {i === 0 ? "" : <span className="text-gray-400">, </span>}
                  <span>
                    <span className="text-purple-500">{k}</span><span className="text-gray-400">: </span>
                    <PrettyJson value={v} />
                  </span>
                </Fragment>
              ))
            }
            {"}"}
          </span>
        )
      }
    default:
      return <span>{props.value}</span>;
  }
}