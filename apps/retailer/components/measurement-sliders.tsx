import React, { useState, useRef, useEffect } from "react";

function generateVals(limit: number): number[] {
  return Array.from({ length: limit }, (_, i) => i + 1);
}

const MeasurementSliders: React.FC = () => {
  const [values, setValues] = useState<number[]>([]);
  const sliderRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Initialize sliders
    setValues(generateVals(10));
  }, []);

  const handleSliderChange = (index: number, value: number) => {
    const newValues = [...values];
    newValues[index] = value;
    setValues(newValues);
  };

  return (
    <div>
      {values.map((val, index) => (
        <div key={index}>
          <input
            type="range"
            min="1"
            max="100"
            value={val}
            onChange={(e) =>
              handleSliderChange(index, parseInt(e.target.value))
            }
            ref={(ref) => {
              sliderRefs.current[index] = ref;
            }}
          />
          <span>{val}</span>
        </div>
      ))}
    </div>
  );
};

export default MeasurementSliders;
