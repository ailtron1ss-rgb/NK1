# V125 Next Frontier

1. Сделать sparse-addressing менее collision-prone без второго memory owner.
2. Перевести unified sparse state к block/segmented representation, чтобы стоимость зависела от активных блоков, а не от полного capacity.
3. Добавить end-to-end memory consolidation: fast event → persistent sparse slot только при доказанном gain.
4. Проверить continual-learning/plasticity на реальных task streams и interference/forgetting.
5. Квалифицировать promotion sparse memory отдельно на recall, learning, interference и runtime — без усредняющего единственного score.
