import * as React from "react";
import styled from "styled-components";

type Props = {
  audio: string;
};

const Wrap = styled.audio`
  height: 25px;
  width: 200px;
`;
const Audio = ({ audio }: Props) => {
  return (
    <div>
      <Wrap controls>
        <source type="audio/mp3" src={audio} />
      </Wrap>
    </div>
  );
};

const Sample =
  "data:audio/mpeg;base64,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%0AWVTsYpUo6OqkB5LK6xeCohARU2gVSLM//8+s7ClhVFYq0qQfTQDn4NUqFJqyMrc3iPJtXNo+mo8H%0A96Q3SHLSGInGoVMYUzofRxUsunObSAhOhweHDYlZIBSGUQGFjU6ts/UppSDGQaiFQXcYNXMZ9P0K%0Ag8xAsQFQ68rG/1Rf/N6HzP/zYsTIHAHylBbSRHzFsLJEh4qRFBLnf/8M/pOtCtQFQKhoq4RCUXBW%0Ai+pIaNvqDEoWFDmopcVACqVkhrwjQuJUsgl0qizSXVeEuCgqsViL84ygKiRRUBUFVK6u4ZlimTuu%0AzelLcmDU0qa1IYanlns1sfqrNeW+MfZC7wAYyRHxSw1ZCFQDBqa8Cz0qC1/KxJIKQAogCMrTYdAL%0AHE3/82DE6B5SYoQWeksEf/wzWv//6661rULscIIeqoqLNfJsHPWMf/1cl2N/sqHu0wk9DHCJblUc%0AiuaKnbMtHJyVkqElKw8ioLQdGgezA7OF6xuGDbMtJUyGlQk7D7kbtmoaXzchgg3Nzc2DNyZ225n9%0AMzP1ZgvT+tPVzcrZlpDhCORkysGCgnR0dP//JZZ9lv+ahgoMI6WVDNZ6sFD/82LE/SWqhkACwlFI%0AwIOhkagQUKCDo8sB1PsstL+WG5Us/rymEQkMEyHYeKh4IhEQFyO3/W5lRW9PYwiJKkxBTUUzLjEw%0AMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq%0Aqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NixPYljBWYAGDLzKqqqqqqqqqqqqqqqqqq%0Aqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq%0Aqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq%0Aqqqqqqqqqqqqqqqqqqqqqg==";

export { Audio, Sample };
