import React from 'react';

export function CuttingMat({ width, height }) {
  return (
    <>
      <rect width={width} height={height} fill="steelblue" />
      <g stroke="#bed3e5">
        {Array.from({ length: 82 }, (_, index) => (
          <line
            key={`x${index}`}
            x1={15.5 + index * 10}
            x2={15.5 + index * 10}
            y1={17}
            y2={577}
            strokeWidth={index > 0 && index % 10 === 0 ? 0.9 : 0.35}
          />
        ))}
        {Array.from({ length: 57 }, (_, index) => (
          <line
            key={`y${index}`}
            x1={15.5}
            x2={825.5}
            y1={17 + index * 10}
            y2={17 + index * 10}
            strokeWidth={index > 0 && index % 10 === 0 ? 0.9 : 0.35}
          />
        ))}
      </g>
    </>
  );
}

function RulerTicks({ millimeter }) {
  const isCentimeter = millimeter % 10 === 0;
  const isHalfCentimeter = millimeter % 5 === 0;
  const fullLength = isCentimeter ? 10 : isHalfCentimeter ? 6 : 3;
  const length = millimeter <= 5 ? millimeter : fullLength;
  const strokeWidth = isCentimeter ? 0.42 : isHalfCentimeter ? 0.34 : 0.28;

  return (
    <g strokeWidth={strokeWidth}>
      <line x1={millimeter} x2={millimeter} y1={0} y2={length} />
      <line y1={millimeter} y2={millimeter} x1={0} x2={length} />
    </g>
  );
}

export function Ruler() {
  return (
    <>
      <polygon
        points="0,0 205,0 205,30 40,30 30,40 30,205 0,205"
        fill="lightskyblue"
        fillOpacity="0.55"
      />
      <g stroke="black">
        {Array.from({ length: 200 }, (_, index) => (
          <RulerTicks key={index + 1} millimeter={index + 1} />
        ))}
      </g>
    </>
  );
}
