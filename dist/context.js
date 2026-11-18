export function projectContext(project, notes, budget=1800) {
  const recent = notes.filter(n=>n.id===project.id).slice(-5).reverse();
  const lines = [project.name, project.id, project.description, project.types.join(', ')];
  if (project.guides.length) lines.push('Guide: '+project.guides.join(', '));
  for (const note of recent) lines.push(note.date.slice(0,10)+' · '+note.text);
  const full = lines.filter(Boolean).join('\n');
  return full.length > budget ? full.slice(0,budget-1)+'…' : full;
}
