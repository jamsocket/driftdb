import { useCallback } from 'react'
import TextInput from './TextInput'

interface TextInputProps {
  value: number
  setValue: (st: number) => void
}

export default function IntInput(props: TextInputProps) {
  const { setValue } = props

  const onChange = useCallback(
    (e: string) => {
      if (e === '') {
        setValue(0)
        return
      }
      const parsed = parseInt(e)
      if (!isNaN(parsed)) {
        setValue(parsed)
      }
    },
    [setValue]
  )

  return <TextInput value={props.value.toString()} setValue={onChange} />
}
