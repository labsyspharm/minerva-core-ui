import { useEffect, useState } from "react";

// Debounce function
const debounce = (fn, wait) => {
  let timeout: number;
  return (...args) => {
    const later = () => {
      timeout = null;
      fn(...args);
    };
    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
};

const getSize = ({ innerWidth, innerHeight } = window) => {
  return {
    width: innerWidth,
    height: innerHeight,
  };
};

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState(getSize);

  useEffect(() => {
    const handle = debounce(() => {
      setWindowSize(getSize());
    }, 250);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  return windowSize;
};

export { useWindowSize };
