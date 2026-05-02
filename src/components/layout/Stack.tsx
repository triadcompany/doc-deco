import { ReactNode } from 'react';

interface StackProps {
  children: ReactNode;
  direction?: 'row' | 'col';
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  className?: string;
  wrap?: boolean;
}

const spacingClasses = {
  xs: 'gap-0.25',
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5',
  xl: 'gap-2',
  '2xl': 'gap-3',
};

const directionClasses = {
  row: 'flex-row',
  col: 'flex-col',
};

const alignClasses = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyClasses = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

export const Stack = ({
  children,
  direction = 'col',
  spacing = 'md',
  align = 'start',
  justify = 'start',
  className = '',
  wrap = false,
}: StackProps) => {
  const classes = [
    'flex',
    directionClasses[direction],
    spacingClasses[spacing],
    alignClasses[align],
    justifyClasses[justify],
    wrap ? 'flex-wrap' : '',
    className,
  ].join(' ');

  return <div className={classes}>{children}</div>;
};