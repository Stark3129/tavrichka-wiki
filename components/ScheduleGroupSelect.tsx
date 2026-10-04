'use client';

export default function ScheduleGroupSelect({
  groups,
  defaultValue,
}: {
  groups: string[];
  defaultValue: string;
}) {
  return (
    <select
      id="sch-group"
      name="group"
      defaultValue={defaultValue}
      className="input"
      onChange={(e) => {
        if (e.target.value) {
          const form = e.target.form;
          if (form) form.requestSubmit();
        }
      }}
    >
      <option value="">— выберите группу —</option>
      {groups.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );
}
