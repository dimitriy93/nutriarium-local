import HistoryClient from "@/components/history-client";

/**
 * История питания: список дней с итогами КБЖУ, новые сверху.
 * Данные читаются из IndexedDB на клиенте.
 */
export default function HistoryPage() {
  return <HistoryClient />;
}
