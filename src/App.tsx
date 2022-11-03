import { lazy, Suspense } from 'react';
import { Route, Switch } from 'react-router-dom';
import Loader from './components.ts/Loader';

const E404 = lazy(() => import('./pages/404'));

const App = () => {
    return (
        <>
            <div className='main'>
                <Suspense fallback={<Loader occupyFullScreen={true} />}>
                    <Switch>
                        <Route component={E404} />
                    </Switch>
                </Suspense>
            </div>
        </>
    );
};

export default App;
