import { lazy, Suspense } from 'react';
import { useHistory } from 'react-router';
import { Route, Switch } from 'react-router-dom';
import Loader from './components.ts/Loader';

const AppPage = lazy(() => import('./pages/App'));
const E404 = lazy(() => import('./pages/404'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

const App = () => {
    const history = useHistory();

    return (
        <>
            <div className='main'>
                <Suspense fallback={<Loader occupyFullScreen={true} />}>
                    <Switch>
                        <Route component={AppPage} path='/app' />
                        <Route exact component={Login} path='/login' />
                        <Route exact component={Register} path='/register' />
                        <Route
                            exact
                            component={() => {
                                history.push('/login');
                                return <></>;
                            }}
                            path='/'
                        />
                        <Route component={E404} />
                    </Switch>
                </Suspense>
            </div>
        </>
    );
};

export default App;
