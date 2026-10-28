import { useQuery } from "@tanstack/react-query";
import { TodoList } from "@/components/TodoList";
import { Card, Loaded, PageHeader } from "@/components/ui";
import { listTodo } from "@/data/api";
import { useI18n } from "@/i18n";

export function Todo() {
  const { t } = useI18n();
  const todo = useQuery({ queryKey: ["todo"], queryFn: listTodo });
  return (
    <>
      <PageHeader title={t.todo.title} intro={t.todo.intro} />
      <Card>
        <Loaded query={todo}>{(items) => <TodoList items={items} />}</Loaded>
      </Card>
    </>
  );
}
