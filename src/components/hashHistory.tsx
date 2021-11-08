import * as React from "react";
import {Repo} from "./repo";
import {
  Routes, Route, Outlet, useParams,
  useLocation, useNavigate
} from "react-router-dom";
// Types
import type {
  HashState, KV
} from '../lib/hashUtil';
import type {
  Exhibit
} from '../lib/exhibit';

type Props = {
  emptyHash: HashState
  exhibit: Exhibit
}

const unpackKV = (entry): KV => {
  const [key, val] = entry.split('=');
  return [ key, val.split('_') ];
}

const packKV = ([k, v]: KV) => {
  return [k, v.join('_')].join('=');
}

const deserialize = ({str, empty}) => {
  // Read all variables from pathname
  const entries = str.split('/').filter(s => s.includes('='));
  const hash = Object.fromEntries(entries.map(unpackKV));
  return { ...empty, ...hash };
};

const serialize = (hashState) => {
  // Write all variables from pathname
  const keys = 'swgmavop'.split('');
  const hashEntries = keys.map(k => [k, hashState[k] || []]);
  return '/' + hashEntries.map(packKV).join('/');
}

const useHash = (emptyHash) => {
  const loc = useLocation();
  const hashString = loc.pathname;
  return React.useMemo(() => {
    return deserialize({
      empty: emptyHash,
      str: hashString,
    })
  }, [hashString, emptyHash]);
}

const useHashSetter = () => {
  const navigate = useNavigate();
  return React.useMemo(() => {
    return (newState: HashState) => {
      const hash = serialize(newState)
      navigate({pathname: hash})
    }
  }, [navigate]);
}

const HashHistory = (props:Props) => {
  const {exhibit, emptyHash} = props
  const hash = {
    state: useHash(emptyHash),
    set: useHashSetter()
  }
  const repo = <Repo hash={hash}/>
  const outlet = (
    <>
      {JSON.stringify(useParams())}
      <Outlet/>
    </>
  )
  return (
    <Routes>
      <Route path="/" element={repo}>
        <Route {...{
          path: `s=:s`
        }}>
          <Route {...{
            path: `w=:w`
          }}>
            <Route {...{
              path: `g=:g`
            }}>
              <Route path="m=:m">
                <Route path="a=:a">
                  <Route path="v=:v">
                    <Route path="o=:o">
                      <Route {...{
                        path: "p=:p",
                        element: outlet
                      }}/>
                    </Route>
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={repo}/>
    </Routes>
  )
}

export {
  HashHistory
}
