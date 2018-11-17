import Vue from 'vue'
import Vuex from 'vuex'
import axios from 'axios'
import VueAxios from 'vue-axios'
import router from './router'

Vue.use(Vuex);
Vue.use(VueAxios, axios);

export default new Vuex.Store({
    state: {
        userLoggedIn: false,
        userName: '',
        password: '',
        userToken: '',
        userAuthorized: false,
        currentPageJson: {},
        currentProject: {},
        nameAvailable: false,
        error: ''
    },
    mutations: {
        setPage(state, data) {
            state.currentPageJson = data
        },
        setNameAvailable(state, data) {
            state.nameAvailable = data
        },
        setAuthorized(state, data) {
            state.userAuthorized = data
        },
        setFailState (state, error) {
            state.error = error
        },
        setToken (state, data) {
            state.userToken = data
        },
        setUserName (state, name) {
            state.userName = name
        }
    },
    getters: {
        getPageInfo: state => state.currentPageJson,
        getPageHidden: state => state.currentPageJson.public,
        getNameAvailable: state => state.nameAvailable,
        getUser: state => state.userName,
        getToken: state => state.userToken
    },
    actions: {
        getPortfolioJson({commit}, {to}) {
                let queryString = `/api${to.fullPath}`
                return axios.post(queryString, to.id)
                .then(({data}) => commit('setPage', {data}))
                .catch(error => commit('setFailState', error))
        },
        getUserPage({ commit }, {userData}){
            let queryString = `/api/user/${userData.userName}`
            return axios.post(queryString, userData) 
                .then(({res}) => res ? commit('setPage', res) : router.push({name: `/login`}))
        },
        authUser({commit}, credentials){
            return axios.post('/api/user/auth/', credentials).then(res => {
                console.log(res)
                if (res.data.auth){
                    commit('setToken', res.data.token)
                    commit('setUserName', res.data.userName)
                    
                }
                else {
                commit('setFailState', res.message)
                console.log('invalid user')
                }
            })
        },
        /////////// this will require using the getter function as store.dispatch('checkNameAvailable', name).then(() => store.getters.getNameAvailable)
        checkNameAvailable ({commit}, {name, pageType}) {
            commit('setNameAvailable', false)
            let queryString = `/api/${pageType}/query/${name}`
            return axios.post(queryString, name).then(res => commit('setNameAvailable', {res}))
        },
        addUserOrPort (context, {name, data, pageType}){
            if (!context.state.nameAvailable) return false;
            else{
                let queryString = `/api/manage/${pageType}/${name}`
                return axios.post(queryString, data).then(() => true)
            }
        },
        addProject (context, {name, data}) {
            let queryString = `/api/manage/project/${name}`
            return axios.post(queryString, data).then(() => true)
        },
        updateElement (context, {name, data, pageType}) {
            let queryString = `/api/manage/${pageType}/${name}`
            return axios.put(queryString, data).then(() => true)
        },
        deleteElement (context, {name, pageType}){
            let queryString = `/api/manage/${pageType}/${name}`
            return axios.delete(queryString, name).then(() => true)
        }
    }
})