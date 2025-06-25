import React, { useState, useEffect } from 'react';

function DayCounter() {
  // ******************************************************
  // ** 重要：请在这里修改为你和女朋友在一起的纪念日！ **
  // ** 格式：'年-月-日'，例如：'2022-01-01'           **
  // ******************************************************
  const startDate = new Date('2024-10-24');

  const [days, setDays] = useState(0);

  useEffect(() => {
    const today = new Date();
    const timeDiff = today.getTime() - startDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    setDays(daysDiff);
  }, [startDate]); // 当 startDate 变化时重新计算

  return (
    <div className="day-counter cute-font">
      <h2>我们已经甜甜蜜蜜地在一起</h2>
      <span className="days">{days}</span>
      <h2>天啦！</h2>
    </div>
  );
}

export default DayCounter;
    
