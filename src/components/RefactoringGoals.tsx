import React from 'react';

const GOALS = [
  { id: 'optimize-loops', label: 'Optimize Loops' },
  { id: 'improve-error-handling', label: 'Improve Error Handling' },
  { id: 'refactor-for-modularity', label: 'Refactor for Modularity' },
  { id: 'enhance-security', label: 'Enhance Security' },
  { id: 'increase-readability', label: 'Increase Readability' },
  { id: 'idiomatic-style', label: 'Adhere to Idiomatic Style' },
  { id: 'improve-documentation', label: 'Improve Documentation' },
];

interface RefactoringGoalsProps {
  selectedGoals: string[];
  onGoalsChange: (goals: string[]) => void;
}

export const RefactoringGoals: React.FC<RefactoringGoalsProps> = ({
  selectedGoals,
  onGoalsChange,
}) => {
  const handleCheckboxChange = (goalId: string) => {
    const newGoals = selectedGoals.includes(goalId)
      ? selectedGoals.filter((g) => g !== goalId)
      : [...selectedGoals, goalId];
    onGoalsChange(newGoals);
  };

  return (
    <div>
      <fieldset>
        <legend className="text-sm font-medium text-gray-400 mb-2">
          Refactoring Goals (Optional)
        </legend>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {GOALS.map((goal) => (
            <div key={goal.id} className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id={goal.id}
                  name={goal.id}
                  type="checkbox"
                  checked={selectedGoals.includes(goal.id)}
                  onChange={() => handleCheckboxChange(goal.id)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-brand-blue focus:ring-brand-blue"
                />
              </div>
              <div className="ml-2 text-sm leading-6">
                <label htmlFor={goal.id} className="font-medium text-gray-300 cursor-pointer">
                  {goal.label}
                </label>
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-gray-500 mt-1.5 ml-1">
        Guide the AI to focus on specific improvements like performance or security.
      </p>
    </div>
  );
};
