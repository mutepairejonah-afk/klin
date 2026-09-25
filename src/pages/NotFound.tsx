import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';

export default function NotFound() {
  return (
    <>
      <HeaderLeft><span className="h-title">Not found</span></HeaderLeft>
      <HeaderRight />
      <div className="wrap">
        <div className="card empty">
          <div className="ico-sq"><Icon name="search" /></div>
          <b>This page doesn’t exist</b>Check the address or go back to a task.
          <div style={{ marginTop: 14 }}><Link className="btn pri" to="/">New task</Link></div>
        </div>
      </div>
    </>
  );
}
