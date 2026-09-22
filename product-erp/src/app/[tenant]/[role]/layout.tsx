import DefaultLayout from '@/shared/layouts';
import React from 'react';

const layout = ({ children }: { children: React.ReactNode }) => {
  return <DefaultLayout>{children}</DefaultLayout>;
};

export default layout;
