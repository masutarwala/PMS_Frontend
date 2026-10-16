export function Spinner({ size = 20 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Loading" />;
}

export function FullPageLoader() {
  return (
    <div className="blank">
      <Spinner size={32} />
    </div>
  );
}

/** Loading row inside a data table. */
export function TableLoading({ colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 40, textAlign: 'center' }}>
        <Spinner />
      </td>
    </tr>
  );
}
