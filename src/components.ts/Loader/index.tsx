import './Loader.css';

const Loader = (props: { occupyFullScreen?: boolean }) => {
    return (
        <div className='loader-parent' style={props.occupyFullScreen ? { minHeight: '100vh' } : {}}>
            <div className='loader' />
        </div>
    );
};

export default Loader;
