import React from 'react';

const TimeInput12 = ({ value, onChange, style, name, required }) => {
    return (
        <input
            type="time"
            name={name}
            value={value}
            required={required}
            onChange={onChange}
            style={style}
        />
    );
};

export default TimeInput12;
